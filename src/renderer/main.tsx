import { render } from 'solid-js/web';
import './styles.css';
import App from './App';
import { runSettingWorker } from './settingworker';

if (location.hash === '#setting') void runSettingWorker();
else render(() => <App />, document.getElementById('root')!);
