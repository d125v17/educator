interface IProps {
  children: React.ReactNode | string;
}

export default function PanelHeader({ children }: IProps) {
  return (
    <div className="bg-gray-100 p-4">
      <h1 className="text-2xl font-bold">{children}</h1>
    </div>
  );
}