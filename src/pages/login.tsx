import Input from "@/components/Input";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import React from "react";

export default function Home() {
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<null | string>(null);

  const handleSubmit = () => {
    setError("api not connected yet")
  }

  return (
    <div>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>
      Home
      <Panel>
        <Input
          label="name"
          value={name}
          onChange={setName}
        />
        {error && <p className="text-red-700">{error}</p>}

        <Button onClick={() => handleSubmit()}>Login</Button>
      </Panel>
      end
    </div>
  );
}
