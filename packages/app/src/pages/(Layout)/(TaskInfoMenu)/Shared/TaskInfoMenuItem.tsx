import { ChangeEventHandler } from "react";
import DateTimePicker from "./DateTimePicker";

export interface TaskInfoMenuItemOptions {
  type?: string;
  name: string;
  value: any;
  onChange: ChangeEventHandler<any> | undefined;
  placeholder?: string;
}

export default function TaskInfoMenuItem({
  name,
  type,
  value,
  onChange,
  placeholder,
}: TaskInfoMenuItemOptions) {
  let inputPiece = (
    <input
      id={name.toLowerCase()}
      name={name.toLowerCase()}
      type={type}
      className="text-base px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 text-primary shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[#253350]"
      placeholder={placeholder ?? `${name}...`}
      value={value as any}
      onChange={onChange}
      autoFocus={false}
    />
  );

  if (type == "textarea") {
    inputPiece = (
      <textarea
        id={name.toLowerCase()}
        name={name.toLowerCase()}
        className="resize-none text-base px-3 py-2 rounded-lg border border-accent-blue/20 bg-silver-200 text-primary shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[#253350]"
        placeholder={placeholder ?? `${name}...`}
        value={value as any}
        onChange={onChange}
        autoFocus={false}
      ></textarea>
    );
  } else if (type === "datetime-local") {
    inputPiece = (
      <DateTimePicker
        value={value as string}
        onChange={(val) => onChange?.({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name.toLowerCase()} className="text-sm font-semibold text-primary px-1">
        {name}
      </label>
      {inputPiece}
    </div>
  );
}
