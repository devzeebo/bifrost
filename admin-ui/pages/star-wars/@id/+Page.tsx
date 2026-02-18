import { useData } from "vike-react/useData";
import type { Data } from "./+data";
import { Dialog } from "@/theme";

export const Page = () => {
  const { movie } = useData<Data>();

  return (
    <Dialog.Root>
      <Dialog.Trigger>Test</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Example dialog</Dialog.Title>
          <Dialog.Description>
            <h1 className="text-xl font-bold">{movie.title}</h1>
            <p>Release Date: {movie.release_date}</p>
            <p>Director: {movie.director}</p>
            <p>Producer: {movie.producer}</p>
          </Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
