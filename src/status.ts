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
  .requiredOption('-t, --topic <topic>', 'Full ntfy URL to send notifications to (e.g., https://ntfy.sh/topic)')
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

const validateNtfyUrl = (ntfyUrl: string): boolean => {
  try {
    const parsedUrl = new URL(ntfyUrl);
    return parsedUrl.hostname === process.env.NTFY;
  } catch (e) {
    return false;
  }
};

const extractTopicFromUrl = (ntfyUrl: string): string => {
  const parsedUrl = new URL(ntfyUrl);
  return parsedUrl.pathname.replace('/', '');
};

const extractHostFromUrl = (url: string): string => {
  const parsedUrl = new URL(url);
  return parsedUrl.hostname;
};

const requestWithRetry = async (url: string, retries: number = 3): Promise<AxiosResponse | null> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 10000, maxRedirects: 5 });
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

const checkWebsiteStatus = async (url: string, ntfyUrl: string) => {
  if (!validateUrl(url)) {
    console.error('Error: Invalid URL. Ensure the URL starts with http:// or https://');
    process.exit(1);
  }

  if (!validateNtfyUrl(ntfyUrl)) {
    console.error('Error: Invalid ntfy URL.');
    process.exit(1);
  }

  const topic = extractTopicFromUrl(ntfyUrl);
  const websiteHost = extractHostFromUrl(url);

  try {
    let response: AxiosResponse | null = null;
    try {
      response = await requestWithRetry(url);
    } catch (headError) {
      console.error('Failed to access the website after multiple attempts:', headError);
      await sendNotification(ntfyUrl, `Website is DOWN: ${websiteHost}`, `Failed to access ${url} after retries.`);
      return;
    }

    if (response) {
      const status = response.status;
      const finalUrl = response.request.res.responseUrl;

      if (status >= 200 && status < 300) {
        console.log(`\n✅ Website is UP: ${url} (Final URL: ${finalUrl}, Status: ${status})\n`);
        await sendNotification(ntfyUrl, `Website is UP: ${websiteHost}`, `${url} is accessible with status code ${status}`);
        console.log('\n');
      } else {
        console.log(`\n⚠️ Website is DOWN or not fully operational: ${url} (Final URL: ${finalUrl}, Status: ${status})\n`);
        await sendNotification(ntfyUrl, `Website is DOWN: ${websiteHost}`, `${url} returned status code ${status}`);
        console.log('\n');
      }
    }
  } catch (error) {
    console.error('An unexpected error occurred while checking the website:', error);
    await sendNotification(ntfyUrl, `Website is DOWN: ${extractHostFromUrl(url)}`, `Failed to access ${url}`);
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
      console.error(`Failed to send notification. Status code`);
    }
  } catch (error) {
    console.error('Failed to send notification.');
  }
};

(async () => {
  const { url, topic } = options;
  await checkWebsiteStatus(url, topic);
})();
