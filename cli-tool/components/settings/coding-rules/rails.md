---
description: Rails conventions for .rb and .erb files
globs: ["**/*.rb", "**/*.erb"]
---

# Rails Rules

## MVC Structure
- Follow "fat models, thin controllers". Business logic lives in models or service objects, not controllers.
- Controllers are responsible only for: parsing params, calling the right service/model method, and rendering a response.
- Views contain no business logic. Extract helpers for non-trivial view computations.

## Models
- Validate all user-supplied data at the model level using ActiveRecord validations.
- Use scopes (not class methods) for reusable query fragments: `scope :active, -> { where(active: true) }`.
- Extract shared model behavior into concerns under `app/models/concerns/`.
- Use `before_action` and callbacks sparingly. Prefer explicit service calls over hidden callbacks.

## Controllers
- Use strong parameters with `require` and `permit` for every action that accepts user input.
- Keep each action to roughly ten lines. Extract longer logic into service objects.
- Follow RESTful routing. Create new controllers for non-CRUD actions rather than adding custom actions to existing controllers.

## Service Objects
- Place service objects in `app/services/`. One class per operation (e.g., `UserRegistrationService`).
- Give service objects a single public method (`call` or a descriptive verb).
- Return a result object or raise a domain exception. Never return raw ActiveRecord objects from a service that does complex logic.

## Internationalization
- Use I18n for all user-facing strings. Never hard-code English text in views or mailers.
- Keep locale files organized by feature, not by model.

## Security
- Never trust user input. Always use parameterized queries (ActiveRecord does this by default).
- Avoid `html_safe` and `raw` in views unless the content is known to be safe.
- Use `authenticate_user!` (Devise) or equivalent before actions that require authentication.
