// Web / non-iOS twin — Apple Sign In only exists on iOS, so render nothing.
export function AppleSignInButton(_props: { onPress: () => void; disabled?: boolean }) {
  return null;
}
