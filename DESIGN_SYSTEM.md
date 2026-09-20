# STAR PYRAMIDS Homepage Design System

## 1. Design philosophy
The homepage follows the provided STAR PYRAMIDS references: bright white surfaces, a restrained Egypt-blue navigation and footer, warm orange actions, compact travel cards, generous section whitespace, and image-led storytelling. The interface is flat and editorial rather than SaaS-like: borders are subtle, shadows are rare, and controls are large enough for travel planning.

## 2. Reference hierarchy
The exact section order is header, promotional bar, hero/search, statistics, Christmas tours, popular destinations, Make Your Trip banner, special offers, How it works, Highlights, blogs, sustainability, journey gallery, reviews, FAQ, help form, and footer.

## 3. Color tokens
- `--primary`: `#F7951D`, action orange.
- `--primary-hover`: `#E88410`, hover orange.
- `--blue`: `#163A96`, navigation, hero and help panels.
- `--text`: `#1D1F1F`, primary copy.
- `--muted`: `#A5A5A5`, labels and secondary copy.
- `--surface`: `#FFFFFF`.
- `--soft`: `#F7F7F7`.
- `--border`: `#DEDEDE`.

## 4. Typography
Arial/Helvetica is used as the close geometric sans fallback. Display headings use 42–68px, weight 700–900, line-height 1.05. Section headings use 29–42px. Card titles use 17px/1.25. Body copy is 13–16px with relaxed line-height. Buttons and labels are 13–18px at 600–700 weight.

## 5. Spacing and containers
The spacing foundation uses 4px increments, with common values 8, 12, 16, 20, 24, 28, 34, 40, 54, 76. `.container` is capped at 1450px and uses 24px desktop / 16px mobile gutters. Sections use 76px vertical padding on desktop and 54px on mobile.

## 6. Layout and breakpoints
Desktop grids use four columns for tours/destinations, three for blogs/reviews, and 1530px page intent with a 1450px content cap. At 1100px grids reduce to two columns. At 760px navigation collapses, forms stack, cards become one column, stats become 2×2, and floating controls move inward.

## 7. Radius and borders
Controls use pill radius. Inputs use 18px, cards 20px, large banners 22–32px, modal 30px, and circular icon buttons 50%. Borders are 1px `#DEDEDE`; cards do not use heavy shadows.

## 8. Buttons
Primary buttons are orange pills with white 600–700 weight text, 52–58px height, and 15px horizontal padding minimum. Outline buttons are blue bordered pills. Icon buttons are 42–54px circles. Hover is a darker orange and a 1px lift; focus-visible should use a visible blue/orange ring.

## 9. Inputs, radios, selects
Search fields are large rounded containers with 58–70px minimum height, muted placeholder text, labels above, and trailing calendar/chevron icons. Radio options are native-like circular orange controls implemented with a visible inner dot. Search tabs are white/soft-gray rounded top pills and switch the form content without navigation.

## 10. Search module
The search module is absolutely positioned at the lower hero edge, capped at 1330px, and overlaps the following content. It has three stateful tabs: Make Your Trip, Find your trip, and Rent Car. Each tab provides its own controls and CTA; radio state is local and date fields are keyboard-focusable controls.

## 11. Cards
Tour cards share one reusable component: 175px image, heart action, optional red Special Offer badge, teal/orange metadata, 17px title, price, and duration pill. Destination cards are 250px image-led overlays. Blog cards use 190px images, small metadata, title, and blue text link. Hover elevation is limited to a subtle 8px/24px shadow.

## 12. Navigation and promo bar
The header is white, 88px desktop, with logo, central navigation, language/currency, cart and sign-in. The promotional bar is blue, 64–78px, with centered white copy and an orange CTA.

## 13. Hero and floating actions
The hero is approximately 610px desktop with a full-bleed source image, dark readable overlay, centered white title, and overlapping search module. Accessibility and WhatsApp controls are fixed in a vertical group on the right and repositioned on mobile.

## 14. Accordions, modal and gallery
FAQ rows have one open item at a time and rotate their chevron. The language/currency dialog uses a dark scrim, 635px white modal, close control, and selected dark option. The journey gallery uses stateful previous/next controls and three visible images.

## 15. Footer and forms
The help panel is blue with inline fields on desktop and stacked fields on mobile. The footer is charcoal with logo/description, links, contact information, and copyright/legal row. Inputs retain white backgrounds and rounded 10px corners.

## 16. Motion and z-index
Transitions are limited to 150ms ease-out for hover, accordion chevrons, cards, and button feedback. Header is z-index 20, search is z-index 3, floating controls 15, modal 50, toast 60.

## 17. Accessibility
All meaningful images have alt text, icon-only controls have accessible labels, modal close and buttons are keyboard targets, form fields have labels, status feedback uses `role=status`, and semantic header/nav/main/section/footer elements are used. Color is not the sole indicator of interaction state.

## 18. Responsive rules
Mobile preserves order and hierarchy rather than redesigning. Navigation becomes a menu, tabs remain horizontally scrollable, forms stack, touch targets remain at least 42px, stats wrap, and floating actions avoid the form. Desktop retains spacious constrained sections and the screenshot density.

## 19. Image ratios
Tour images use roughly 1.8:1, destinations use tall 1:1.1 cards, highlight thumbnails use landscape crops, blogs use 1.8:1, and the hero uses full-bleed cover positioning.

## 20. Component consistency
Repeated patterns are represented by `Heading`, `Field`, `TourCard`, and the shared button classes. Tokens live in `app/globals.css`; homepage composition lives in `components/homepage.tsx`; canonical Tour content and identity live in `data/tours.ts`.
