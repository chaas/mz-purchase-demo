import Head from "next/head";
import Image from "next/image";
import { Inter } from "@next/font/google";
import styles from "@/styles/Home.module.css";
import { useSubscribe } from "@/hooks";
import Heatmap from "../components/heatmap";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const {} = useSubscribe({
    query: { sql: "SELECT 1" },
    config: {
      auth: {
        password: "",
        user: "",
      },
      host: "",
    },
  });

  return (
    <div className="App">
      <h1
        style={{
          color: "#055C9D",
          textAlign: "center",
          fontSize: "40px",
        }}
      >
        Purchases in the Past Hour by State
      </h1>
      <Heatmap />
    </div>
  );
}
