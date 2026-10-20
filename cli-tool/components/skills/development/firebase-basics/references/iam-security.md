# Firebase security-related features

Firebase offers several security-related features and services, including:

- **Identity and Access Management (IAM)**: Restrict a project member's
  administrative access for projects, resources, and data.
- **Firebase Security Rules**: Restrict client-side access for Firestore data
  and Cloud Storage for Firebase data to only authorized users.
- **Firebase App Check**: Restrict client-side access for APIs and backend
  resources to only an authentic client and an authentic, untampered device.

## Identity and Access Management (IAM)

Here are some common IAM roles:

| Role | Description |
|---|---|
| `roles/viewer` | Permissions for read-only actions, such as viewing (but not modifying) existing resources or data. |
| `roles/editor` | All the `roles/viewer` permissions, plus permissions for actions that modify state, such as changing existing resources. |
| `roles/owner` | All the `roles/editor` permissions, plus permissions for the following actions: manage IAM for a project, manage all resources within the project, set up and manage billing for a project, and delete or restore a project. |
| `roles/firebase.viewer` | Read-only access to Firebase resources and data. |
| `roles/firebase.admin` | Full access to all Firebase products and project management. |

For details about IAM and Firebase, see
https://firebase.google.com/docs/projects/iam/overview.md.txt

## Firebase Security Rules

Firebase Security Rules are CRITICAL to protecting Firestore data and
Cloud Storage for Firebase data from unauthorized mobile and web client-side
access. They are defined in the project directory (e.g., `firestore.rules`)
and deployed using the Firebase CLI.

Here is a basic example of Security Rules for Firestore that restricts access
to authenticated end-users only:

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /some_collection/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**CRITICAL**: Agent Skills for Firebase provide tools to draft and test Firebase
Security Rules. Install these skills by running:

```bash
npx -y skills add firebase/agent-skills -y
```

## Firebase App Check

Firebase App Check is CRITICAL to protecting a project's enabled APIs and
backend resources from unauthorized clients and devices. For example, it can
help protect Firebase AI Logic, Firestore, Cloud Storage for Firebase,
Cloud Functions for Firebase, and Firebase Data Connect.

For details about Firebase App Check, see
https://firebase.google.com/docs/app-check.md.txt

## Security best practices

- **Principle of least privilege:** Assign specific product-level roles instead
  of `roles/owner` whenever possible.
- **Firebase App Check:** Use this service to protect a project's enabled APIs
  and backend resources from abuse by allowing only authentic clients and
  devices to access them.
- **Environment management:** Use separate Firebase projects for development,
  staging, and production.
- **Sensitive operations:** Always have a human user approve sensitive
  operations like granting permissive IAM roles or deleting a database.