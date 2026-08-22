import { Task } from "@/hooks/tasks";
import { TaskInfoMenuDelete } from "./Shared/TaskInfoMenuDelete";
import { TaskInfoMenuComplete } from "./Shared/TaskInfoMenuComplete";

interface MenuEditProps {
    type: string;
    tempData: Task;
    isDeleting: boolean;
    setIsDeleting: (state: boolean) => void;
    closeMenu: () => void;
}

export default function MenuEdit({ type, tempData, isDeleting, setIsDeleting, closeMenu }: MenuEditProps) {
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
