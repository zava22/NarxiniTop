import { createContext } from "react";

/* false = the admin lists never request remote product images (no 404 noise, faster on slow links). */
export const ThumbsContext = createContext(true);
