export const onPageTransitionEnd = () => {
  console.log("Page transition end");
  document.body.classList.remove("page-transition");
};
