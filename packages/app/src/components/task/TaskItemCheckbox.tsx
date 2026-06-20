import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface TaskItemCheckBoxProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

export default function TaskItemCheckBox({ checked, ...props }: TaskItemCheckBoxProps) {
  return (
    <label
      className={`group relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 px-0.5 py-0.5 transition ${
        checked
          ? "border-accent-blue bg-linear-to-br from-accent-blue-600 to-accent-blue-500 shadow-xs shadow-accent-blue/30 md:hover:from-accent-blue-700 md:hover:to-accent-blue-600 md:hover:shadow-accent-blue/50"
          : "border-accent-blue/50 bg-white hover:border-accent-blue dark:bg-[rgba(15,23,42,0.7)]"
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      aria-checked={checked}
      role="checkbox"
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        {...props}
      />
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-md text-white transition ${
          checked ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        {checked ? (
          <>
            <CheckIcon className="h-4 w-4 md:group-hover:hidden" />
            <XMarkIcon className="h-4 w-4 hidden md:group-hover:block" />
          </>
        ) : (
          <CheckIcon className="h-4 w-4" />
        )}
      </div>
    </label>
  );
}
