import { ScreenDeviceSettings } from '@/components/device/ScreenDeviceSettings';
import ScreenDataPrivacy from '@/components/screens/ScreenDataPrivacy';
import { Separator } from '@/components/ui/separator';

/**
 * Personal device settings route (`/settings` · PRODUCT.md Page 7 / Flow 6 "editable
 * later"). Lives under the `(app)` group so it inherits the app shell + the
 * `CallEngineProvider` (which `ScreenDeviceSettings` reads `selfDeviceId` from). Open
 * to every role — this is the device-user's OWN name surface, distinct from the admin
 * `/admin/members` directory.
 *
 * V32.9: Data & Privacy DSR self-service section appended below device settings.
 */
export default function SettingsPage() {
  return (
    <div>
      <ScreenDeviceSettings />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-8 md:px-12">
        <Separator className="my-6" />
        <ScreenDataPrivacy />
      </div>
    </div>
  );
}
