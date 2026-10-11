import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { CatalogProvider } from "./context/CatalogContext";
import { LocationProvider } from "./context/LocationContext";
import { DisplayPrefsProvider } from "./context/DisplayPrefsContext";
import { UserDataProvider } from "./context/UserDataContext";
import { BrowserRouter } from "react-router-dom";

import "./styles/tokens.css";
import "./index.css";
import "./styles/platform.css";
import "./styles/design.css";
import "./styles/cart-footer.css";
import "./styles/refresh.css";
import "./styles/revamp.css"; // wins every desktop conflict
import "./styles/contact.css"; // contact page + footer contact button
import "./styles/polish.css"; // site-wide polish
import "./styles/cart.css"; // cart page (simple cards, inner scroll)
import "./styles/card.css"; // product cards (.pc-*)
import "./styles/admin.css"; // admin panel (.adm-*)
import "./styles/upgrade.css"; // site-wide visual refresh (v2)
import "./styles/cards-banners.css"; // card outlines, product-card layout, stronger banners
import "./styles/about.css"; // About page
import "./styles/location.css"; // map picker + nearest-by-chain carousel
import "./styles/branches.css"; // supermarket branch directory + chain accordion
import "./styles/layout.css"; // centred column + compact banners (desktop only)
import "./styles/mobile.css"; // phones only (max-width media queries)
import "./styles/phone.css"; // phone layer v2 + compact desktop footer; must stay last

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <CatalogProvider>
            <UserDataProvider>
              <CartProvider>
                <LocationProvider>
                  <DisplayPrefsProvider>
                    <BrowserRouter>
                      <App />
                    </BrowserRouter>
                  </DisplayPrefsProvider>
                </LocationProvider>
              </CartProvider>
            </UserDataProvider>
          </CatalogProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>
);
