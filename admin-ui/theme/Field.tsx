import { Field as BaseField } from "@base-ui/react";
import { Input as BaseInput } from "@base-ui/react/input";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { tailwind } from "./tailwind";

export const Field = {
  Root: tailwind(BaseField.Root, "flex flex-col gap-1"),
  Label: tailwind(BaseField.Label, "text-sm font-medium text-[var(--text-primary)]"),
  Error: tailwind(BaseField.Error, "text-xs text-[var(--danger)]"),
  Description: tailwind(BaseField.Description, "text-xs text-[var(--text-secondary)]"),
  Input: BaseInput,
  TextInput: tailwind(
    BaseInput,
    "w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Checkbox: BaseCheckbox,
  CheckboxRoot: tailwind(
    BaseCheckbox.Root,
    "w-5 h-5 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center data-[checked]:bg-[var(--accent)] data-[checked]:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  CheckboxIndicator: BaseCheckbox.Indicator,
  Radio: BaseRadio,
  RadioRoot: tailwind(
    BaseRadio.Root,
    "w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center data-[checked]:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  RadioIndicator: BaseRadio.Indicator,
  RadioGroup: tailwind(BaseRadioGroup, "flex flex-col gap-2"),
  Switch: BaseSwitch,
  SwitchRoot: tailwind(
    BaseSwitch.Root,
    "w-11 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] data-[checked]:bg-[var(--accent)] data-[checked]:border-[var(--accent)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  SwitchThumb: tailwind(
    BaseSwitch.Thumb,
    "block w-5 h-5 rounded-full bg-[var(--text-primary)] transition-transform translate-x-0.5 data-[checked]:translate-x-[1.375rem]",
  ),
  Slider: BaseSlider,
  SliderRoot: tailwind(BaseSlider.Root, "w-full h-5 flex items-center"),
  SliderControl: tailwind(BaseSlider.Control, "w-full h-full flex items-center"),
  SliderTrack: tailwind(
    BaseSlider.Track,
    "w-full h-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)]",
  ),
  SliderIndicator: tailwind(BaseSlider.Indicator, "h-full rounded-full bg-[var(--accent)]"),
  SliderThumb: tailwind(
    BaseSlider.Thumb,
    "w-5 h-5 rounded-full bg-[var(--text-primary)] border border-[var(--border)] shadow focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
} as const;
