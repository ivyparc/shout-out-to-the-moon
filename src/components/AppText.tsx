import { ComponentProps } from "react";
import { Text } from "react-native";

type Props = ComponentProps<typeof Text>;

export function AppText(props: Props) {
  return <Text {...props} allowFontScaling={false} />;
}
