"use client";

import { useEffect } from "react";
import { navigate } from "@/lib/router";

export { Page };

function Page() {
  useEffect(() => {
    navigate("/dashboard");
  }, []);

  return null;
}
