// https://vike.dev/onPageTransitionStart

import type { PageContextClient } from "vike/types";

export const onPageTransitionStart = (pageContext: Partial<PageContextClient>) => {
  console.log("Page transition start");
  console.log("pageContext.isBackwardNavigation", pageContext.isBackwardNavigation);
  document.body.classList.add("page-transition");
};
