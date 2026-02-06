import React from 'react';
import './NotificationSettings.css';

const NotificationSettings = () => {
    const [settings, setSettings] = React.useState({
        email: true,
        sms: false,
        webhook: false,
        inApp: false,
        verification: false
    });

    const toggleSetting = (type) => {
        setSettings(prevState => ({
            ...prevState,
            [type]: !prevState[type]
        }));
    };

    const saveSettings = () => {
        // Save settings logic
    };

    const resetSettings = () => {
        setSettings({
            email: true,
            sms: false,
            webhook: false,
            inApp: false,
            verification: false
        });
    };

    return (
        <div className="sb-NotificationSettings">
            <h2 className="sb-NotificationSettings__title">Notification Settings</h2>
            <div className="sb-NotificationSettings__section">
                <h3>Event Type Toggles</h3>
                <label>
                    <input type="checkbox" checked={settings.email} onChange={() => toggleSetting('email')} /> Email
                </label>
                <label>
                    <input type="checkbox" checked={settings.sms} onChange={() => toggleSetting('sms')} /> SMS
                </label>
                <label>
                    <input type="checkbox" checked={settings.webhook} onChange={() => toggleSetting('webhook')} /> Webhook
                </label>
                <label>
                    <input type="checkbox" checked={settings.inApp} onChange={() => toggleSetting('inApp')} /> In-App
                </label>
            </div>
            <div className="sb-NotificationSettings__section">
                <h3>Channel Preferences</h3>
                <label>
                    <input type="checkbox" checked={settings.verification} onChange={() => toggleSetting('verification')} /> Verification Required
                </label>
            </div>
            <div className="sb-NotificationSettings__buttons">
                <button onClick={saveSettings}>Save</button>
                <button onClick={resetSettings}>Reset</button>
                <button onClick={() => alert('Test Notification Sent!')}>Send Test Notification</button>
            </div>
        </div>
    );
};

export default NotificationSettings;