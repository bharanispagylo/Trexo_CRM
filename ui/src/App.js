import { useState } from "react";
import LoginWithRoles from "./components/LoginWithRoles";
import EmployeeRegister from "./components/EmployeeRegister";

function App() {
  const [page, setPage] = useState("login");

  if (page === "register") {
    return (
      <div>
        <button
          onClick={() => setPage("login")}
          style={{
            position: "fixed", top: "1rem", left: "1rem", zIndex: 9999,
            background: "#1e293b", color: "#fff", border: "none",
            borderRadius: "10px", padding: "0.5rem 1rem",
            cursor: "pointer", fontSize: "0.85rem", fontWeight: 600,
          }}
        >← Back</button>
        <EmployeeRegister />
      </div>
    );
  }

  return <LoginWithRoles onNavigate={setPage} />;
}

export default App;
