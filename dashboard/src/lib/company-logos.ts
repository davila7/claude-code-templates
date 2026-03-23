// Company logo utilities
export function getCompanyLogoUrl(company: string, existingIcon?: string): string {
  if (existingIcon) return existingIcon;
  
  // Try Clearbit Logo API (free tier)
  const domain = getCompanyDomain(company);
  if (domain) {
    return `https://logo.clearbit.com/${domain}`;
  }
  
  // Fallback to first letter
  return '';
}

export function getCompanyDomain(company: string): string | null {
  const companyLower = company.toLowerCase().trim();
  
  // Known company domains
  const knownDomains: Record<string, string> = {
    'anthropic': 'anthropic.com',
    'google': 'google.com',
    'meta': 'meta.com',
    'facebook': 'facebook.com',
    'amazon': 'amazon.com',
    'microsoft': 'microsoft.com',
    'apple': 'apple.com',
    'netflix': 'netflix.com',
    'uber': 'uber.com',
    'airbnb': 'airbnb.com',
    'stripe': 'stripe.com',
    'shopify': 'shopify.com',
    'github': 'github.com',
    'gitlab': 'gitlab.com',
    'vercel': 'vercel.com',
    'netlify': 'netlify.com',
    'cloudflare': 'cloudflare.com',
    'aws': 'aws.amazon.com',
    'gcp': 'cloud.google.com',
    'azure': 'azure.microsoft.com',
    'openai': 'openai.com',
    'databricks': 'databricks.com',
    'snowflake': 'snowflake.com',
    'mongodb': 'mongodb.com',
    'redis': 'redis.com',
    'elastic': 'elastic.co',
    'confluent': 'confluent.io',
    'datadog': 'datadoghq.com',
    'twilio': 'twilio.com',
    'sendgrid': 'sendgrid.com',
    'segment': 'segment.com',
    'amplitude': 'amplitude.com',
    'mixpanel': 'mixpanel.com',
    'figma': 'figma.com',
    'notion': 'notion.so',
    'slack': 'slack.com',
    'discord': 'discord.com',
    'zoom': 'zoom.us',
    'dropbox': 'dropbox.com',
    'box': 'box.com',
    'atlassian': 'atlassian.com',
    'jira': 'atlassian.com',
    'confluence': 'atlassian.com',
    'asana': 'asana.com',
    'monday': 'monday.com',
    'airtable': 'airtable.com',
    'retool': 'retool.com',
    'supabase': 'supabase.com',
    'planetscale': 'planetscale.com',
    'railway': 'railway.app',
    'render': 'render.com',
    'fly.io': 'fly.io',
    'heroku': 'heroku.com',
    'digitalocean': 'digitalocean.com',
    'linode': 'linode.com',
    'vultr': 'vultr.com',
  };
  
  // Check known domains first
  for (const [key, domain] of Object.entries(knownDomains)) {
    if (companyLower.includes(key)) {
      return domain;
    }
  }
  
  // Try to extract domain from company name
  // Remove common suffixes
  let cleanName = companyLower
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  
  if (cleanName) {
    return `${cleanName}.com`;
  }
  
  return null;
}

export function getCompanyInitials(company: string): string {
  const words = company.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return company.charAt(0).toUpperCase();
}
