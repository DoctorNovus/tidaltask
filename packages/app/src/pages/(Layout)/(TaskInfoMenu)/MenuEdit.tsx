import { Task } from "@/hooks/tasks";
import { TaskInfoMenuDelete } from "./Shared/TaskInfoMenuDelete";
import { TaskInfoMenuComplete } from "./Shared/TaskInfoMenuComplete";

interface MenuEditProps {
    type: string;
    tempData: Task;
    isDeleting: boolean;
    setIsDeleting: (state: boolean) => void;
    setIsOpen: (state: boolean) => void;
}

export default function MenuEdit({ type, tempData, isDeleting, setIsDeleting, setIsOpen }: MenuEditProps) {
    const closeMenu = (e?: React.MouseEvent<any>) => {
        if (e) e.stopPropagation();

        setIsOpen(false);
    };

    return (
        <>
            {type == "edit" && (
                <div className="flex flex-col gap-2">
                    <TaskInfoMenuComplete
                        task={tempData}
                        closeMenu={closeMenu}
                    />
                    <TaskInfoMenuDelete
                        task={tempData}
                        closeMenu={closeMenu}
                        isDeleting={isDeleting}
                        setIsDeleting={setIsDeleting}
                    />
                </div>
            )}
        </>

    )
}
