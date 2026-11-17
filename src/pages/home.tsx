import Input from "@/components/Input";
import React from "react";

export default function Home() {
  const [name, setName] = React.useState('');


  return (
    <div>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>
      Home
      <Input
        label="name"
        value={name}
        onChange={setName}
      />
      end
    </div>
  );
}
