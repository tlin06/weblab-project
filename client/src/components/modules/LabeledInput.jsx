import React from "react";

const LabeledInput = ({ label, value, onChange, placeholder, type = "text", disabled }) => {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};

export default LabeledInput;
