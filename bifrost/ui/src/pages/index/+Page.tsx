"use client";

import { useEffect } from "react";
import { navigate } from "@/lib/router";

const Page = () => {
  useEffect(() => {
    navigate("/dashboard");
  }, []);

  return null;
};

export { Page };
