---
name: google-cloud-onboarding
description: Guides developers through their first steps on Google Cloud, covering account creation, billing setup, project management, CLI installation, and deploying a first resource.
source: google/skills (Apache 2.0)
---

# Onboarding to Google Cloud

This skill provides a streamlined "happy path" for a singleton developer to get
started with [Google Cloud](https://cloud.google.com/). It covers everything
from initial account setup to deploying your first cloud resource.

## Overview

For an individual developer, onboarding to Google Cloud involves establishing a
personal identity, setting up a billing method, and creating a workspace
([Project](https://docs.cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy#projects))
where resources can be managed. Google Cloud offers a Free Tier and Free Trial
for multiple products. [Learn more
here](https://docs.cloud.google.com/free/docs/free-cloud-features).

## Clarifying Questions

Before proceeding, the agent should clarify the user's current status:

1.  Do you already have a [Google Account](https://accounts.google.com/) (Gmail
    or [Google Workspace](https://workspace.google.com/))?
2.  Are you looking to set up a personal account for learning/experimentation,
    or are you part of an organization with existing infrastructure?
3.  Are you an IT admin within a larger enterprise, setting up Google Cloud for
    your organization?
4.  What is the first type of resource or application you are interested in
    building (e.g., a website, a data pipeline, a virtual machine)?
5.  Do you prefer to use the command line (CLI), an IDE (e.g. VSCode,
    Antigravity), or do you prefer using the web-based [Google Cloud
    console](https://console.cloud.google.com/)?

## Prerequisites

-   A [Google Account](https://accounts.google.com/) (e.g., @gmail.com).
-   A valid payment method (credit card or bank account) for billing
    verification (even for the free trial).

## Steps

### 1. Sign Up and Activate Free Credit

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Sign in with your Google Account. This will "Activate" [your $300 free
    credit](https://docs.cloud.google.com/free/docs/free-cloud-features#free-trial).

### 2. Create Your First Google Cloud Project

Google Cloud resources are organized into
**[Projects](https://docs.cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy#projects)**.

1.  In the Google Cloud console, click the project picker dropdown at the top of
    the page.
2.  Click **New Project**.
3.  Enter a **Project Name** (e.g., `my-first-gcp-project`).
4.  Note the generated **Project ID**; you will use this for CLI and API
    interactions.
5.  Click **Create**.

### 3. Set Up Billing

Ensure your project is linked to your Free Trial [Cloud
Billing](https://docs.cloud.google.com/billing/docs/how-to/manage-billing-account)
account.

1.  Go to the **Billing** section in the console.
2.  Confirm that your new project is listed under "Projects linked to this
    billing account."

### 4. Install and Initialize the Google Cloud CLI

The **[Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk)**
(`gcloud` CLI) is the primary tool for interacting with Google Cloud from your
local machine.

1.  [Download and install the Google Cloud
    CLI](https://cloud.google.com/sdk/docs/install).
2.  Open your terminal and run: `gcloud init`
3.  Follow the prompts to log in and select your project.

### 5. Enable Necessary APIs

Most services require their specific
[API](https://docs.cloud.google.com/apis/docs/overview) to be enabled before
use. For example, to use [Cloud
Run](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run), run:
`gcloud services enable run.googleapis.com`

Note that [some Google Cloud APIs, including Cloud Logging, are enabled by
default](https://docs.cloud.google.com/service-usage/docs/enabled-service#default).

### 6. Deploy Your First Resource

Choose a simple entry point based on your needs:
- **[Cloud Run](https://docs.cloud.google.com/run/docs) (Recommended for Apps):**
Deploy a containerized "Hello World" app.
- **[Compute Engine](https://docs.cloud.google.com/compute/docs):** Create a
small Linux VM (e.g., `e2-micro` which is part of the Always Free tier in
certain regions).
- **[Cloud Storage](https://docs.cloud.google.com/storage/docs):** Create a
bucket to store files.

Example (Cloud Run):

```bash
    gcloud run deploy hello-world \
    --image=gcr.io/cloudrun/hello \ --platform=managed \ --region=us-central1 \
    --allow-unauthenticated --quiet
```

This command will output a public URL, that you can reach in a web browser.
Congrats - you just deployed your first Google Cloud resource!

### 7. Next Steps

-   Explore the [Google Cloud Free Program](https://cloud.google.com/free) to
    see what else you can do with your free credit.
-   Read the [Google Cloud Overview](https://cloud.google.com/docs/overview)
-   See the [full list of 150+ Google Cloud products](https://cloud.google.com/products)
-   Explore the [Enterprise Setup Guide](https://docs.cloud.google.com/docs/enterprise/cloud-setup)
    for information on setting up Google Cloud for a team or organization.
-   Compare [AWS and Azure products to Google Cloud](https://docs.cloud.google.com/docs/get-started/aws-azure-gcp-service-comparison)

## Reference Directory

-   [Google Cloud Setup Guide](reference/google-cloud-setup.md): Detailed
    setup instructions and reference for Google Cloud onboarding.

## Validation Logic

Use this logic to determine if the user has successfully completed the Google
Cloud onboarding process:

-   **Project Created:** Does the user have a Project ID?
-   **Billing Linked:** Is the project associated with a billing account (check
    via `gcloud beta billing projects describe PROJECT_ID`)?
-   **CLI Authenticated:** Does `gcloud config list` show the correct account
    and project?
-   **Resource Verified:** Can the user access the URL or IP of the deployed
    resource?
