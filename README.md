# Star Pyramids 🌟🐫

Welcome to the **Star Pyramids** project! This is a modern, responsive, and beautifully designed web application built for a premier travel and tourism platform, with a special focus on Egypt tours and travel experiences.

## 🚀 Tech Stack

This project is built using cutting-edge web technologies:
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/) & [@base-ui/react](https://base-ui.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Package Manager:** `pnpm`
- **Language:** TypeScript

## 🎨 Design Philosophy & UI/UX

The interface is designed with a flat, editorial, and premium aesthetic rather than a typical SaaS look. 
- **Colors:** Bright white surfaces, a restrained Egypt-blue (`#163A96`) navigation and footer, and warm action orange (`#F7951D`).
- **Typography:** Clean geometric sans-serif (Arial/Helvetica fallback) with generous typography for readability.
- **Components:** Features large readable inputs, pill-shaped action buttons, subtle 8px hover elevations, and dynamic search modules.
- **Responsiveness:** Highly responsive layouts that preserve visual hierarchy on mobile (stacking forms, collapsing navigations, wrapping stats) while utilizing a 1450px wide container on desktop for maximum visual impact.

## 🗺️ Key Features & Pages

The application is structured to handle a comprehensive travel booking and information experience. Main sections include:

- **Tours & Destinations:** Browse curated `egypt-tours`, comprehensive `destinations`, and `special-offers`.
- **Custom Travel Planning:** A dedicated `make-your-trip` interactive feature for personalized itineraries.
- **Additional Services:** `rent-car` functionality and an `egypt-travel-guide` for tourists.
- **Content & Engagement:** `blogs`, `events`, and an interactive journey gallery.
- **Customer Support:** `faq`, `contact`, and `accessible-travel` information.
- **User Management:** Secure user `account`, `login`, `register`, and `forgot-password` pages.

## 📂 Project Structure

```text
web-source/
├── app/                      # Next.js 16 App Router pages and layouts
├── components/               # Reusable UI, layout, and feature presentation
├── data/
│   ├── content.ts            # Destinations, cars, editorial content, and policies
│   ├── tours.ts              # Canonical Tour entities, slugs, prices, and collections
│   └── types.ts              # Shared frontend domain contracts
├── lib/
│   ├── query.ts              # Defensive URL query contracts and parsing
│   └── utils.ts              # Shared utility functions
├── public/                   # Static assets (images, fonts, icons)
├── AGENTS.md                 # Repository map and AI working entry point
├── constitution.md           # Engineering delivery and verification rules
├── DESIGN_SYSTEM.md          # Detailed design tokens and UI rules
└── package.json              # Dependencies and scripts
```

## Frontend Data Contracts

- `data/tours.ts` is the single source of truth for Tour identity, canonical
  slugs, base prices, listing membership, and available detail content.
- Tour base prices are numeric USD values and are formatted only in the UI by
  the existing locale/currency layer.
- Existing Tour aliases remain resolvable, while all new card links use the
  canonical slug.
- Forms and account screens remain frontend prototypes; there is no backend,
  persistence, or production authentication in this phase.

### Query Parameters

| Route | Supported parameters |
| --- | --- |
| `/search` | `q` (trimmed text, maximum 120 characters) |
| `/make-your-trip` | `from`, `to`, and `date` (`YYYY-MM-DD`); `destination` (known destination slug); `tour` (known Tour slug or alias); `guests` (1-50); `step=2` only when valid `from` and `to` are present |
| `/rent-car/request` | `vehicle` (known car slug); `pickup` and `dropoff` (maximum 160 characters); `type` (`One Way` or `Round Trip`); `date` (`YYYY-MM-DD`) |

Unexpected query values are ignored and fall back to safe frontend defaults.

## 🛠️ Getting Started

To run this project locally, follow these steps:

1. **Navigate to the web source directory:**
   ```bash
   cd web-source
   ```

2. **Install dependencies** (using pnpm):
   ```bash
   pnpm install
   ```

3. **Run the development server:**
   ```bash
   pnpm run dev
   ```

4. **Open the app:**
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📜 Scripts

- `pnpm run dev` - Starts the Next.js development server.
- `pnpm run build` - Builds the application for production.
- `pnpm run start` - Starts the production server.

---
*Developed with focus on delivering an immersive and seamless travel booking experience.*
