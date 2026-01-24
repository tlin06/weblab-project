import React, { useContext } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";

import { UserContext } from "../App";

const AuthControls = () => {
  const { userId, handleLogin, handleLogout } = useContext(UserContext);

  if (userId) {
    return (
      <div className="auth-chip">
        <span className="auth-name">Signed in</span>
        <button
          className="button ghost"
          type="button"
          onClick={() => {
            googleLogout();
            handleLogout();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return <GoogleLogin onSuccess={handleLogin} onError={(err) => console.log(err)} useOneTap />;
};

export default AuthControls;
