import { useAppState } from './hooks/useGameState';
import { WelcomePage } from './pages/WelcomePage';
import { ProfilePage } from './pages/ProfilePage';
import { GamePage } from './pages/GamePage';

function App() {
  const { currentPage } = useAppState();

  switch (currentPage) {
    case 'welcome':
      return <WelcomePage />;
    case 'profile':
      return <ProfilePage />;
    case 'game':
      return <GamePage />;
    default:
      return <WelcomePage />;
  }
}

export default App;

