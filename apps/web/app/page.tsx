import DashboardPage from "./main";
import BattleOfTanksPage from "./tanks/page";

export default async function Index() {
    if (process.env.NEXT_PUBLIC_TARGET === "ITCH") {
        return <BattleOfTanksPage />
    }
    return (
        <DashboardPage />
    )
}