import { FC } from 'react';
import { createGlobalStyle } from 'styled-components';

import Header from './Header';
import Footer from './Footer';

type LayoutProps = {
	children: React.ReactNode;
};

const Layout: FC<LayoutProps> = ({ children }) => {
	return (
		<>
			<GlobalStyle />
			<Header />
			<section>{children}</section>
			<Footer />
		</>
	);
};

const GlobalStyle = createGlobalStyle`
  body {
		margin: 0 20px;
		scroll-behavior: smooth;
		font-family: "GT America Mono", sans-serif;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    line-height: 18px;
		/* identical to box height, or 129% */

		background-color: ${(props) => props.theme.colors.darkBlue};
		color: ${(props) => props.theme.colors.lightFont};

		.stats-box-skeleton, .chart-skeleton {
			background-color: ${(props) => props.theme.colors.mediumBlue};
		}

		.chart-skeleton {
			margin-top: -100px;
		}

		.stats-box-skeleton::after, .chart-skeleton::after {
			background: linear-gradient(90deg, #08021E 0%, #120446 146.21%);
		}

		/* Let's get this party started */
		*::-webkit-scrollbar, ::-webkit-scrollbar {
				width: 12px;
		}
		
		/* Track */
		*::-webkit-scrollbar-track, ::-webkit-scrollbar-track {
				-webkit-box-shadow: inset 0 0 6px ${(props) => props.theme.colors.mediumBlue}; 
				-webkit-border-radius: 10px;
				border-radius: 10px;
		}
		
		/* Handle */
		*::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb {
				-webkit-border-radius: 10px;
				border-radius: 10px;
				background: ${(props) => props.theme.colors.mutedBrightPink}; 
				-webkit-box-shadow: inset 0 0 6px ${(props) => props.theme.colors.mediumBlue}; 
		}
		*::-webkit-scrollbar-thumb:window-inactive, ::-webkit-scrollbar-thumb:window-inactive {
			background: ${(props) => props.theme.colors.mutedBrightPink}; 
		}
  }
`;

export default Layout;