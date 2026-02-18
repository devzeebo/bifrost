import { twMerge } from "tailwind-merge";
import type { ComponentProps, ElementType } from "react";

type PropsWithClassName<E extends ElementType> = ComponentProps<E> & {
  className?: string;
};

// oxlint-disable-next-line react/display-name -- this is dynamic
export const tailwind =
  <E extends ElementType>(
    Component: E,
    baseClass: string,
  ): ((props: PropsWithClassName<E>) => React.ReactNode) =>
  (props: PropsWithClassName<E>) => {
    const { className, ...rest } = props;
    // @ts-expect-error - generic component spreading is safe here
    return <Component className={twMerge(baseClass, className)} {...rest} />;
  };
