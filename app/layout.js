import "./globals.css";

export const metadata = {
  "title": "Meal Prep Assistant — Discover meals from what you have.",
  "description": "Meal Prep Assistant helps you find meals from ingredients you have, plan portions, and make a shopping list. Discover meals from what you have.",
  "icons": {
    "icon": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Crect width='50' height='50' rx='14' fill='%23eb6038'/%3E%3Ctext x='10' y='37' font-size='36' fill='white'%3Em%3C/text%3E%3C/svg%3E"
  }
};

export const viewport = { themeColor: "#f8f6ee" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
