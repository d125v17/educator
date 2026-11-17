interface IProps {
  label?: string;
  onChange: (newValuse: string) => void;
  value: string;
}


export default function Input(props: IProps) {
  const { label, onChange, value } = props;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value as string)
  }

  return <div className="w-full">
    {label && <label className="block indent-1">{label}</label>}
    <input value={value} onChange={handleChange} className="w-full outline-none border-stone-50 p-5"/>
  </div>
}