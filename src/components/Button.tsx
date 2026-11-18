import { ReactNode } from "react";

interface IProps {
  children: ReactNode | ReactNode[];
  onClick: () => void;
}

export default function Button(props: IProps) {
  return <button onClick={() => props.onClick()} className="border-none rounded-sm p-2 bg-green-300 cursor-pointer">
    {props.children}
  </button>
}