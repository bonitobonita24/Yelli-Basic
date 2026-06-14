import { ScreenDeviceSettings } from '@/components/device/ScreenDeviceSettings';

/**
 * Personal device settings route (`/settings` · PRODUCT.md Page 7 / Flow 6 "editable
 * later"). Lives under the `(app)` group so it inherits the app shell + the
 * `CallEngineProvider` (which `ScreenDeviceSettings` reads `selfDeviceId` from). Open
 * to every role — this is the device-user's OWN name surface, distinct from the admin
 * `/admin/members` directory.
 */
export default function SettingsPage() {
  return <ScreenDeviceSettings />;
}
