import { ReactNode } from "react";

interface IProps {
  children: ReactNode | ReactNode[];
}

export default function Panel (props: IProps) {
  return <div className="m-auto w-sm max-w-full text-black bg-white p-2 rounded-sm">
    {props.children}
  </div>
}