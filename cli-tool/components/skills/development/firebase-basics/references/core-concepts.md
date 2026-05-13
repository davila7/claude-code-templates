# Firebase core concepts

Firebase is a platform of services for mobile and web applications. It offers
products for managed backend infrastructure (BaaS), building AI-powered
experiences in apps, DevOps, and end-user engagement. Most services are
integrated into apps using mobile and web client SDKs.

## Key services

Here are some popular Firebase products:

- **Firebase Authentication**: Simplify end-user authentication and sign-in on a
  secure, all-in-one identity platform.
- **Firestore**: Store and sync data using a secure, scalable NoSQL cloud
  database with rich data models and queryability.
- **Firebase Data Connect**: Build and scale your apps using a fully-managed
  PostgreSQL relational database service.
- **Cloud Storage for Firebase**: Store and serve unstructured content like
  images, audio, video with a secure cloud-hosted solution.
- **Firebase App Hosting**: Deploy modern, full-stack web apps that require
  server-side rendering and automated secret management, CI/CD, and CDN caching.
- **Firebase Hosting**: Deploy static and single-page web apps to a global CDN
  with a single command.
- **Cloud Functions for Firebase**: Run backend code in response to events and
  HTTPS requests without provisioning or managing a server.
- **Firebase AI Logic**: Build secure AI-powered experiences in mobile and web
  apps using the Gemini API and without provisioning or managing a server.
- **Firebase Crashlytics**: Track, prioritize, and fix stability issues in
  mobile apps.
- **Firebase Cloud Messaging (FCM)**: Send push notifications and messages to
  end users.

## Regional availability

Firebase services are available globally, with several products supporting
specific regional configurations.

- **Firestore**: Each instance can be provisioned in a different location;
  supports multi-region (e.g., `nam5`) and regional (e.g., `us-east1`)
  locations.
- **Cloud Storage for Firebase**: Each bucket can be provisioned in a different
  location.
- **Firebase App Hosting**: Can be deployed to specific regions to minimize
  latency for operations and end users.
- **Firebase Hosting**: Content is delivered via a global CDN.
- **Cloud Functions for Firebase**: Can be deployed to specific regions to
  minimize latency for operations and end users.

## Pricing

Firebase offers two pricing plans:

- **Spark (no-cost) pricing plan**: Projects don't need a billing account to
  use only the no-cost Firebase services and to get started with generous
  no-cost usage quota.
- **Blaze (pay-as-you-go) pricing plan**: Link a billing account to the project
  to access more products and services and to get usage levels beyond the
  no-cost usage quota.

For up-to-date detailed pricing information, see the Firebase pricing
page: https://firebase.google.com/pricing