# Internal User App (B2E)

## Overview

A ready-to-use starter for building internal, employee-facing apps on the Salesforce platform. It comes with a clean, modern interface, page navigation, and a built-in Agentforce chat assistant. It ships with no data of its own — a clean slate — but includes one working example (an Account search with filtering, sorting, and a detail view) that shows how the app reads Salesforce data, so teams can point it at their own information.

## Problem

Teams building internal tools on Salesforce keep re-solving the same setup: standing up a new app, choosing how it looks, connecting it to Salesforce data, and adding an Agentforce assistant. Starting from a prebuilt demo means ripping out someone else's data before any real work begins; starting from scratch means rebuilding the same foundation every time. There has been no simple, opinionated starting point that gives just the essentials and one correct example of showing Salesforce data.

## Solution

A minimal internal starter with the essentials already in place: the app framework, page navigation, a built-in Agentforce chat assistant, and a single example feature — Account search — that shows how the app displays Salesforce data. Everything is structured so the Account example works as a template: point it at your own information, adjust the fields, and remove the example once your own feature is working.

### Core Features

- **App framework and navigation** — A ready-made layout with a Home page, a "page not found" screen, and a navigation menu, prepared for adding new screens.
- **Consistent design system** — A preinstalled set of interface building blocks so new screens look consistent from the start.
- **Account search example** — A complete example with a search bar, filters, sorting, and paging, plus a search results screen and a detail view. This is the template for showing Salesforce data.
- **Agentforce chat assistant** — A built-in chat surface an Agentforce agent can drive, giving the app in-app assistance.
- **Add-on features** — Tooling to browse and add additional prebuilt features into the app.

### Non-Goals

- Shipping a prebuilt data model — this starter deliberately includes none; teams bring their own.
- External-facing use, sign-in, or public site hosting — use the External User App (B2X) starter for that.
- A finished application — the Account example is meant to be copied and then removed, not kept.

## Target Users

Salesforce teams building employee-facing tools (support consoles, ops dashboards, internal admin apps) who want a clean, minimal starting point rather than a demo they have to dismantle first.

## Org prerequisites

- The in-app Agentforce chat assistant requires Agentforce to be set up in the org, with an agent configured for it.
