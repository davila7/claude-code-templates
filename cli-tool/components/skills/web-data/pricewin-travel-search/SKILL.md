---
name: pricewin-travel-search
description: Search and compare live hotel and flight prices with the PriceWin MCP server, look up one named hotel, inspect OpenTravel direct listings, send a booking request to a partner hotel (no payment; the guest pays at the property), and cancel one. Use when the user asks to find hotels or flights for dates, compare travel prices, inspect a hotel or room, check a rate's cancellation policy, book a partner hotel, or cancel a booking they made this way.
---


# PriceWin Travel Search

Use only the tools of the `pricewin` MCP server (`https://mcp.price.win/mcp`,
installed with the `web-data/pricewin` MCP component). Agents prefix them with the server name — for
example `mcp__pricewin__search_hotels_live` — and the steps below use the bare
tool names. Do not replace them with browser automation, shell commands, direct
API calls, or invented booking URLs.

All prices are in USD.

## Collect the required trip details

For a hotel search, obtain:

- destination or city;
- check-in and check-out dates;
- number of adults, defaulting to 2 when the user does not specify;
- number of rooms, defaulting to 1.

For a flight search, obtain:

- origin and destination airport IATA codes;
- departure date and optional return date;
- number of adults, defaulting to 1;
- cabin, defaulting to economy.

Resolve unambiguous relative dates from the current date. Ask one concise
follow-up when a required date, destination, or airport is genuinely ambiguous.
Never invent a date or silently choose among multiple plausible airports.

Pass `language` matching the user's language when supported. Do not put
unrelated conversation or personal data in `queryText`.

## Search hotels

1. Call `search_hotels_live` with the destination, dates, occupancy, and only
   the filters the user actually requested.
2. Read `sessionId` and `nights` from the response.
3. Call `poll_search_results` with that `sessionId` and `nights`.
4. If the response is pending or partial with no useful results, poll again
   until results arrive, the search completes or fails, or the session expires.
5. Present a concise comparison of relevant results. Label the source and
   currency exactly as returned.

Use `hotelName`, `area`, `priceMin`, or `priceMax` only when the user supplied
that constraint. Do not claim that a result is the cheapest in the whole
market; describe it as the cheapest among the sources returned for this search.
A failed or missing source does not invalidate results from other sources.

## Look up one named hotel

When the user names a single hotel rather than a city, call
`get_ota_hotel_detail` with `hotelName` and its `city` (or the Booking.com
`propertyUrl` from an earlier result) and the user's dates. It returns that
hotel's rooms, live prices, facilities and reviews from Booking.com.

## Inspect an OpenTravel direct hotel

Call `get_hotel_detail` only for a hotel identified as an OpenTravel direct
listing.

- Prefer its `propertyId` from `opentravelResults`.
- Reuse the user's dates and occupancy.
- Use `hotelName` plus `city` only when the property is already known to be an
  OpenTravel direct listing and no `propertyId` is available.
- Do not call this tool for an Agoda, Booking.com, or Traveloka-only result.

Present the returned photos, amenities, availability, room capacity, total
price, per-night price, and currency without changing their meaning. State
clearly when availability or a price is missing.

## Answer a question about a hotel

For questions about a hotel itself — check-in and check-out times, facilities,
photos, description, room types — call `get_hotel_info` with the `propertyId`
of an OpenTravel direct listing, usually from `opentravelResults` of a search
already made. It needs no dates and returns no prices or availability; for
those, use `get_hotel_detail`. When the property has not published a field,
say so rather than filling it in.

## Explain a cancellation policy

Call `get_cancellation_policy` only after `get_hotel_detail` supplies both:

- the property's `propertyId`; and
- the selected room's `ratePlanId`.

Pass the check-in date so the tool can compute an exact deadline. Report the
returned non-refundable status, refund percentage, free-cancellation window,
deadline, and summary. Never infer a policy or deadline when the tool does not
return one.

## Search flights

1. Call `search_flights_live` with IATA codes, departure date, optional return
   date, adults, and cabin.
2. Read the returned `sessionId`.
3. Call `poll_flight_results` with that `sessionId`.
4. Continue only until useful results arrive, the search completes or fails, or
   the session expires.
5. Present relevant options with source, carrier, times, stops, cabin, currency,
   and fare exactly as returned.

Keep outbound and return legs distinct. Each leg is a separate one-way ticket
with its own booking link: when you pair an outbound and a return flight, give
the total as the sum of the two fares and say that each leg is booked
separately. Never present a pair as one round-trip ticket, and do not imply that
a fare is still available after the live result expires.

## Request a booking at an OpenTravel direct hotel

Only an OpenTravel direct listing can be booked this way; an Agoda,
Booking.com or Traveloka result cannot, and the user follows its own link
instead.

1. Call `request_booking` with the `propertyId`, `roomTypeId`, dates and the
   guest's name, phone number and email. Ask for whichever of those three is
   missing; they go to the hotel, which needs them to honour the reservation.
2. Relay the tool's reply as written. The two facts it leads with — that no
   room is held and that nothing has been charged — are the ones the guest
   acts on.
3. Keep the `confirmationCode` it returns; `check_booking_status` reads the
   request's state back with it.

There is no payment step, now or later. Never ask how the guest wants to pay,
and never mention a card, transfer, QR code, payment link or deposit — not
even one the guest named earlier. The guest pays the property on arrival.

## Cancel a booking

1. Call `get_cancellation_policy` first, with the `propertyId`, `ratePlanId`
   and check-in date of the booked room, and tell the guest what they will get
   back — or that the property has published no policy.
2. Call `request_cancel_token` with the confirmation code and the email on the
   booking. This cancels nothing; it emails a single-use token.
3. Ask the guest to paste the token from that email. Never invent, guess or
   reuse one.
4. Confirm the booking and the refund amount with the guest in their own
   language, get an explicit yes, then call `cancel_booking` with the code,
   the token and the guest's reason.

`cancel_booking` cannot be undone. If there is no token yet, the answer is
step 2, never step 4.

## Safety and output rules

- Use only these twelve tools: `search_hotels_live`, `poll_search_results`,
  `search_flights_live`, `poll_flight_results`, `get_ota_hotel_detail`,
  `get_hotel_detail`, `get_hotel_info`, `get_cancellation_policy`,
  `request_booking`, `check_booking_status`, `request_cancel_token`, and
  `cancel_booking`.
- Treat all prices as time-sensitive and avoid guarantees or unsupported
  "lowest price" claims.
- Use only outbound URLs returned by the tools. Never construct, append,
  rewrite, or guess a booking URL.
- Collect the guest's name, phone and email only to send a booking request,
  and only when the guest is actually sending one. Never ask for card data,
  bank details, credentials, or any other payment information: no tool here
  accepts them, and no step of this skill takes money.
- Do not modify an existing booking. There is no tool for it; a change means
  cancelling and sending a new request, and saying so plainly.
- If a tool fails, state the limitation briefly and suggest a new search. Do
  not fabricate partial inventory, prices, availability, or policies.
