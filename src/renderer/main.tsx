import { render } from 'solid-js/web';
import './styles.css';
import App from './App';
import { runSettingWorker } from './settingworker';

// the hidden window that reads the code with another build setting (src/main/main.ts setting:start) shows nothing
if (location.hash === '#setting') void runSettingWorker();
else render(() => <App />, document.getElementById('root')!);
