# Nimbus customer journey review

Use this short sheet to confirm that a customer can get from sign-in to a
working phone. It is a review-friendly view of the detailed UAT, not a
replacement for the complete release regression.

## Release details

| Field | Value |
|---|---|
| Release / tag | |
| Environment URL | |
| Admin build | |
| API build | |
| Node build | |
| Reviewed by | |
| Date | |
| Final decision | |

## Before starting

- An administrator account that can create users and extensions.
- Access to the administrator's email for the OTP code.
- A second email address for the new user.
- A softphone such as Zoiper or Linphone.
- An existing application to place the user and extension in.
- For the incoming-call check, a working external number.

## Customer journey

| Step | Customer need | What to do | Pass when | Result | Comments | Detailed UAT |
|---|---|---|---|---|---|---|
| 1 | Sign in securely | Open Nimbus, enter the administrator email and password, and press Sign in. | Nimbus accepts the password and asks for an OTP code. | Not Run | | T-01 |
| 2 | Receive and verify the OTP | Read the OTP from email, enter it, and press Verify. | The dashboard opens and shows the signed-in administrator. | Not Run | | T-02 |
| 3 | Create a user | Open Users, press Create User, enter the new user's name, email and extension number, then save. | The user appears in Users with the correct name, email and extension. | Not Run | | T-28 |
| 4 | Let the new user sign in | In a separate browser profile, sign in with the new user's email and password and complete OTP verification. | The user reaches their own portal and sees only their own information. | Not Run | | T-30 |
| 5 | Add or configure the extension | Open Devices. If user creation already made the extension, open it and set its SIP password. Otherwise press Add Device, choose the application, enter the extension number and SIP password, then save. | The extension appears in Devices and initially shows as offline or not registered. | Not Run | | T-28, T-34 |
| 6 | Register the phone | Enter the extension number, SIP password and server address in the softphone, then connect it. | The softphone reports that registration succeeded. | Not Run | | T-35 |
| 7 | See the registration in Nimbus | Return to Devices and refresh the list. | The extension's visible status changes to Registered or Online. | Not Run | | T-35 |
| 8 | Call another extension | Register a second extension and call it from the first softphone. Answer, speak both ways, then hang up. | The other phone rings, both people hear audio, and hanging up ends the call. | Not Run | | T-36 |
| 9 | Receive an outside call | Point a test number at the registered extension and call it from an outside phone. | The softphone rings and the call connects with audio in both directions. | Not Run | | T-44 |
| 10 | Confirm the call record | End the call and open the call log. | The completed call shows the correct parties, direction, time and duration. | Not Run | | T-73 |

Allowed results: `Pass`, `Fail`, `Blocked`, or `Not Run`. Explain every failure
in Comments and include the approximate time so it can be found in Logs.
