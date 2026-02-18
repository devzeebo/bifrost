import { Button } from "@base-ui/react/button";
import { useCallback, useState } from "react";

export const Counter = () => {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return (
    <Button
      className="inline-block border border-black rounded bg-gray-200 px-2 py-1 text-xs font-medium uppercase leading-normal hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 active:bg-gray-400"
      onClick={handleClick}
    >
      Counter {count}
    </Button>
  );
};
