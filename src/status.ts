import axios, { AxiosResponse } from 'axios';
import { Command } from 'commander';
import dotenv from 'dotenv';
import * as process from 'process';

dotenv.config();

const program = new Command();

program
  .name('website')
  .description('CLI to check website HTTP status and send notifications to ntfy')
  .version('0.0.1')
  .requiredOption('-u, --url <url>', 'URL of the website to check')
  .requiredOption('-t, --topic <topic>', 'Topic name for ntfy notifications (e.g., my-topic)')
  .parse(process.argv);

const options = program.opts();

const validateUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (e) {
    return false;
  }
};

const validateTopic = (topic: string): boolean => /^[a-zA-Z0-9_-]+$/.test(topic);

const getNtfyUrl = (topic: string): string => {
  const baseUrl = process.env.NTFY_BASE_URL;
  if (!baseUrl || !validateUrl(baseUrl)) {
    console.error('Error: Invalid or missing NTFY_BASE_URL environment variable.');
    process.exit(1);
  }
  return `${baseUrl.replace(/\/$/, '')}/${topic}`;
};

const requestWithRetry = async (url: string, retries: number = 3): Promise<AxiosResponse | null> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 10000, maxRedirects: 10 });
      return response;
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed, retrying...`);
      if (attempt === retries - 1) {
        throw error;
      }
    }
  }
  return null;
};

const handleHttpResponse = async (url: string, response: AxiosResponse, ntfyUrl: string, websiteHost: string) => {
  const status = response.status;
  const finalUrl = response.request.res.responseUrl;

  if (status >= 200 && status < 300) {
    console.log(`✅ Website is UP: ${url} (Final URL: ${finalUrl}, Status: ${status})`);
    await sendNotification(ntfyUrl, `Website is UP: ${websiteHost}`, `${url} is accessible with status code ${status}`);
  } else if (status >= 300 && status < 400) {
    console.log(`🔄 Website redirected: ${url} (Final URL: ${finalUrl}, Status: ${status})`);
    await sendNotification(ntfyUrl, `Website Redirected: ${websiteHost}`, `${url} was redirected to ${finalUrl}`);
    if (finalUrl.includes('login')) {
      console.log('⚠️ Redirected to a login page.');
      await sendNotification(ntfyUrl, `Login Page Detected: ${websiteHost}`, `${url} was redirected to a login page.`);
    }
  } else if (status >= 400 && status < 500) {
    console.log(`❌ Client error: ${url} (Status: ${status})`);
    let message = `Client error (${status}) for ${url}`;
    if (status === 401) message = `Unauthorized access (401) for ${url}`;
    if (status === 404) message = `Page not found (404) for ${url}`;
    await sendNotification(ntfyUrl, `Website Client Error: ${websiteHost}`, message);
  } else if (status >= 500) {
    console.log(`❌ Server error: ${url} (Status: ${status})`);
    let message = `Server error (${status}) for ${url}`;
    if (status === 503) message = `Service unavailable (503) for ${url}`;
    await sendNotification(ntfyUrl, `Website Server Error: ${websiteHost}`, message);
  }
};

const checkWebsiteStatus = async (url: string, topic: string) => {
  if (!validateUrl(url)) {
    console.error('Error: Invalid website URL. Ensure it starts with http:// or https://');
    process.exit(1);
  }

  if (!validateTopic(topic)) {
    console.error('Error: Invalid topic. Ensure the topic contains only alphanumeric characters, dashes, or underscores.');
    process.exit(1);
  }

  const ntfyUrl = getNtfyUrl(topic);
  const websiteHost = new URL(url).hostname;

  try {
    const response = await requestWithRetry(url);
    if (response) {
      await handleHttpResponse(url, response, ntfyUrl, websiteHost);
    }
  } catch (error) {
    console.error('An unexpected error occurred while checking the website.');
    await sendNotification(ntfyUrl, `Website is DOWN: ${websiteHost}`, `Failed to access ${url}.`);
  }
};

const sendNotification = async (ntfyUrl: string, title: string, message: string) => {
  try {
    const response = await axios.post(ntfyUrl, message, {
      headers: {
        Title: title,
      },
      timeout: 10000,
    });
    if (response.status >= 200 && response.status < 300) {
      console.log('🔔 Notification sent successfully!');
    } else {
      console.error(`Failed to send notification.`);
    }
  } catch (error) {
    console.error('Failed to send notification.');
  }
};

(async () => {
  const { url, topic } = options;
  await checkWebsiteStatus(url, topic);
})();
