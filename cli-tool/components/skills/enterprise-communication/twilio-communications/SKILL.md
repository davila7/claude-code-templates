---
name: twilio-communications
description: "Build communication features with Twilio: SMS messaging, voice calls, WhatsApp Business API, and user verification (2FA). Covers the full spectrum from simple notifications to complex IVR systems and multi-channel authentication. Critical focus on compliance, rate limits, and error handling. Use when: twilio, send SMS, text message, voice call, phone verification."
source: vibeship-spawner-skills (Apache 2.0)
---

# Twilio Communications

## Patterns

### SMS Sending Pattern

Basic pattern for sending SMS messages with Twilio.
Handles the fundamentals: phone number formatting, message delivery,
and delivery status callbacks.

Key considerations:
- Phone numbers must be in E.164 format (+1234567890)
- Default rate limit: 80 messages per second (MPS)
- Messages over 160 characters are split (and cost more)
- Carrier filtering can block messages (especially to US numbers)


**When to use**: ['Sending notifications to users', 'Transactional messages (order confirmations, shipping)', 'Alerts and reminders']

```python
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import os
import re

class TwilioSMS:
    """
    SMS sending with proper error handling and validation.
    """

    def __init__(self):
        self.client = Client(
            os.environ["TWILIO_ACCOUNT_SID"],
            os.environ["TWILIO_AUTH_TOKEN"]
        )
        self.from_number = os.environ["TWILIO_PHONE_NUMBER"]

    def validate_e164(self, phone: str) -> bool:
        """Validate phone number is in E.164 format."""
        pattern = r'^\+[1-9]\d{1,14}$'
        return bool(re.match(pattern, phone))

    def send_sms(
        self,
        to: str,
        body: str,
        status_callback: str = None
    ) -> dict:
        """
        Send an SMS message.

        Args:
            to: Recipient phone number in E.164 format
            body: Message text (160 chars = 1 segment)
            status_callback: URL for delivery status webhooks

        Returns:
            Message SID and status
        """
        # Validate phone number format
        if not self.validate_e164(to):
            return {
                "success": False,
                "error": "Phone number must be in E.164 format (+1234567890)"
            }

        # Check message length (warn about segmentation)
        segment_count = (len(body) + 159) // 160
        if segment_count > 1:
            print(f"Warning: Message will be sent as {segment_count} segments")

        try:
            message = self.client.messages.create(
                to=to,
                from_=self.from_number,
                body=body,
                status_callback=status_callback
            )

            return {
                "success": True,
                "message_sid": message.sid,
                "status": message.status,
                "segments": segment_count
            }

        except TwilioRestException as e:
            return self._handle_error(e)

    def _handle_error(self, error: Twilio
```

### Twilio Verify Pattern (2FA/OTP)

Use Twilio Verify for phone number verification and 2FA.
Handles code generation, delivery, rate limiting, and fraud prevention.

Key benefits over DIY OTP:
- Twilio manages code generation and expiration
- Built-in fraud prevention (saved customers $82M+ blocking 747M attempts)
- Handles rate limiting automatically
- Multi-channel: SMS, Voice, Email, Push, WhatsApp

Google found SMS 2FA blocks "100% of automated bots, 96% of bulk
phishing attacks, and 76% of targeted attacks."


**When to use**: ['User phone number verification at signup', 'Two-factor authentication (2FA)', 'Password reset verification', 'High-value transaction confirmation']

```python
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import os
from enum import Enum
from typing import Optional

class VerifyChannel(Enum):
    SMS = "sms"
    CALL = "call"
    EMAIL = "email"
    WHATSAPP = "whatsapp"

class TwilioVerify:
    """
    Phone verification with Twilio Verify.
    Never store OTP codes - Twilio handles it.
    """

    def __init__(self, verify_service_sid: str = None):
        self.client = Client(
            os.environ["TWILIO_ACCOUNT_SID"],
            os.environ["TWILIO_AUTH_TOKEN"]
        )
        # Create a Verify Service in Twilio Console first
        self.service_sid = verify_service_sid or os.environ["TWILIO_VERIFY_SID"]

    def send_verification(
        self,
        to: str,
        channel: VerifyChannel = VerifyChannel.SMS,
        locale: str = "en"
    ) -> dict:
        """
        Send verification code to phone/email.

        Args:
            to: Phone number (E.164) or email
            channel: SMS, call, email, or whatsapp
            locale: Language code for message

        Returns:
            Verification status
        """
        try:
            verification = self.client.verify \
                .v2 \
                .services(self.service_sid) \
                .verifications \
                .create(
                    to=to,
                    channel=channel.value,
                    locale=locale
                )

            return {
                "success": True,
                "status": verification.status,  # "pending"
                "channel": channel.value,
                "valid": verification.valid
            }

        except TwilioRestException as e:
            return self._handle_verify_error(e)

    def check_verification(self, to: str, code: str) -> dict:
        """
        Check if verification code is correct.

        Args:
            to: Phone number or email that received code
            code: The code entered by user

        R
```

### TwiML IVR Pattern

Build Interactive Voice Response (IVR) systems using TwiML.
TwiML (Twilio Markup Language) is XML that tells Twilio what to do
when receiving calls.

Core TwiML verbs:
- <Say>: Text-to-speech
- <Play>: Play audio file
- <Gather>: Collect keypad/speech input
- <Dial>: Connect to another number
- <Record>: Record caller's voice
- <Redirect>: Move to another TwiML endpoint

Key insight: Twilio makes HTTP request to your webhook, you return
TwiML, Twilio executes it. Stateless, so use URL params or sessions.


**When to use**: ['Phone menu systems (press 1 for sales...)', 'Automated customer support', 'Appointment reminders with confirmation', 'Voicemail systems']

```python
from flask import Flask, request, Response
from twilio.twiml.voice_response import VoiceResponse, Gather
from twilio.request_validator import RequestValidator
import os

app = Flask(__name__)

def validate_twilio_request(f):
    """Decorator to validate requests are from Twilio."""
    def wrapper(*args, **kwargs):
        validator = RequestValidator(os.environ["TWILIO_AUTH_TOKEN"])

        # Get request details
        url = request.url
        params = request.form.to_dict()
        signature = request.headers.get("X-Twilio-Signature", "")

        if not validator.validate(url, params, signature):
            return "Invalid request", 403

        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@app.route("/voice/incoming", methods=["POST"])
@validate_twilio_request
def incoming_call():
    """Handle incoming call with IVR menu."""
    response = VoiceResponse()

    # Gather digits with timeout
    gather = Gather(
        num_digits=1,
        action="/voice/menu-selection",
        method="POST",
        timeout=5
    )
    gather.say(
        "Welcome to Acme Corp. "
        "Press 1 for sales. "
        "Press 2 for support. "
        "Press 3 to leave a message."
    )
    response.append(gather)

    # If no input, repeat
    response.redirect("/voice/incoming")

    return Response(str(response), mimetype="text/xml")

@app.route("/voice/menu-selection", methods=["POST"])
@validate_twilio_request
def menu_selection():
    """Route based on menu selection."""
    response = VoiceResponse()
    digit = request.form.get("Digits", "")

    if digit == "1":
        # Transfer to sales
        response.say("Connecting you to sales.")
        response.dial(os.environ["SALES_PHONE"])

    elif digit == "2":
        # Transfer to support
        response.say("Connecting you to support.")
        response.dial(os.environ["SUPPORT_PHONE"])

    elif digit == "3":
        # Voicemail
        response.say("Please leave a message after 
```

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Issue | high | ## Track opt-out status in your database |
| Issue | medium | ## Implement retry logic for transient failures |
| Issue | high | ## Register for A2P 10DLC (US requirement) |
| Issue | critical | ## ALWAYS validate the signature |
| Issue | high | ## Track session windows per user |
| Issue | critical | ## Never hardcode credentials |
| Issue | medium | ## Implement application-level rate limiting too |
