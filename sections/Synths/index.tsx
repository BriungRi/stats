import { FC, useEffect, useContext, useState } from 'react';
import styled from 'styled-components';
import ethers from 'ethers';
import orderBy from 'lodash/orderBy';
import findIndex from 'lodash/findIndex';
import { useTranslation } from 'react-i18next';

import SectionHeader from 'components/SectionHeader';
import { MAX_PAGE_WIDTH, COLORS } from 'constants/styles';
import { SNXJSContext, SUSDContext, ProviderContext } from 'pages/_app';
import { OpenInterest, SynthTotalSupply } from 'types/data';
import SingleStatRow from 'components/SingleStatRow';
import DoubleStatsBox from 'components/DoubleStatsBox';
import StatsRow from 'components/StatsRow';

import SynthsBarChart from './SynthsBarChart';
import SynthsPieChart from './SynthsPieChart';

const MIN_PERCENT_FOR_PIE_CHART = 0.03;
const NUMBER_OF_TOP_SYNTHS = 3;
const subtitleText = (name: string) => `Price and market cap for ${name}`;

const SynthsSection: FC<{}> = () => {
	const { t } = useTranslation();
	const [pieChartData, setPieChartData] = useState<SynthTotalSupply[]>([]);
	const [barChartData, setBarChartData] = useState<OpenInterest>({});
	const snxjs = useContext(SNXJSContext);
	const { sUSDPrice } = useContext(SUSDContext);
	const provider = useContext(ProviderContext);
	const { formatEther, parseBytes32String } = snxjs.utils;

	useEffect(() => {
		const fetchData = async () => {
			const [
				synthTotalSupplies,
				unformattedEthShorts,
				unformattedBtcShorts,
				unformattedBtcPrice,
				unformattedEthPrice,
			] = await Promise.all([
				snxjs.contracts.SynthUtil.synthsTotalSupplies(),
				snxjs.contracts.CollateralManager.short(snxjs.toBytes32('sETH')),
				snxjs.contracts.CollateralManager.short(snxjs.toBytes32('sBTC')),
				snxjs.contracts.ExchangeRates.rateForCurrency(snxjs.toBytes32('sBTC')),
				snxjs.contracts.ExchangeRates.rateForCurrency(snxjs.toBytes32('sETH')),
			]);

			const [ethShorts, btcShorts, btcPrice, ethPrice] = [
				unformattedEthShorts,
				unformattedBtcShorts,
				unformattedBtcPrice,
				unformattedEthPrice,
			].map((val) => Number(formatEther(val)));

			let totalValue = 0;
			const unsortedOpenInterest: SynthTotalSupply[] = [];
			for (let i = 0; i < synthTotalSupplies[0].length; i++) {
				const value = Number(formatEther(synthTotalSupplies[2][i]));
				const name = parseBytes32String(synthTotalSupplies[0][i]);
				const totalSupply = Number(formatEther(synthTotalSupplies[1][i]));

				let combinedWithShortsValue = value;
				const assetPrice = value / totalSupply;
				if (name === 'iETH') {
					combinedWithShortsValue += ethShorts * ethPrice;
				} else if (name === 'iBTC') {
					combinedWithShortsValue += btcShorts * btcPrice;
				}
				unsortedOpenInterest.push({
					name,
					totalSupply,
					value: combinedWithShortsValue,
				});
				totalValue += value;
			}

			const openInterestSynths = snxjs.synths
				.filter((synth) => ['crypto', 'index'].includes(synth.category))
				.map(({ name }) => name);

			const openInterest: OpenInterest = orderBy(unsortedOpenInterest, 'value', 'desc')
				.filter((item) => openInterestSynths.includes(item.name))
				.reduce((acc: OpenInterest, curr: SynthTotalSupply): OpenInterest => {
					const name = curr.name.slice(1);
					const isEthShort = curr.name === 'iETH';
					const isBtcShort = curr.name === 'iBTC';
					const isShort = isEthShort || isBtcShort;

					const subObject = {
						[curr.name]: {
							value: curr.value,
							totalSupply: curr.totalSupply ?? 0,
							isShort,
							shortSupply: isEthShort ? ethShorts : isBtcShort ? btcShorts : null,
						},
					};
					if (acc[name]) {
						acc[name] = { ...acc[name], ...subObject };
					} else {
						acc[name] = subObject;
					}
					return acc;
				}, {});

			const formattedPieChartData = unsortedOpenInterest.reduce((acc, curr) => {
				if (curr.value / totalValue < MIN_PERCENT_FOR_PIE_CHART) {
					// @ts-ignore
					const othersIndex = findIndex(acc, (o) => o.name === 'others');
					if (othersIndex === -1) {
						// @ts-ignore
						acc.push({ name: 'others', value: curr.value });
					} else {
						// @ts-ignore
						acc[othersIndex].value = acc[othersIndex].value + curr.value;
					}
				} else {
					// @ts-ignore
					acc.push(curr);
				}
				return acc;
			}, []);
			setBarChartData(openInterest);
			setPieChartData(orderBy(formattedPieChartData, 'value', 'desc'));
		};
		fetchData();
	}, []);
	const totalValue = pieChartData.reduce((acc, { value }) => acc + value, 0);
	return (
		<>
			<SectionHeader title={t('section-header.synths')} />
			<SingleStatRow
				text={t('total-synths.title')}
				subtext={t('total-synths.subtext')}
				num={totalValue}
				color={COLORS.green}
				numberStyle="currency0"
			/>
			<SynthsCharts>
				<SynthsBarChart data={barChartData} />
				<SynthsPieChart data={pieChartData} />
			</SynthsCharts>
			<SubsectionHeader>{t('top-synths.title')}</SubsectionHeader>
			<StatsRow>
				{pieChartData.map(({ name, totalSupply, value }: SynthTotalSupply, index: number) => {
					if (index < NUMBER_OF_TOP_SYNTHS) {
						return (
							<DoubleStatsBox
								key={name}
								title={name}
								subtitle={subtitleText(name)}
								firstMetricTitle={t('top-synths.price')}
								firstMetricStyle="currency2"
								firstMetric={name === 'sUSD' ? sUSDPrice : value / (totalSupply ?? 0)}
								firstColor={index === 0 ? COLORS.pink : COLORS.green}
								secondMetricTitle={t('top-synths.marketCap')}
								secondMetric={value}
								secondColor={index === 2 ? COLORS.pink : COLORS.green}
								secondMetricStyle="currency0"
							/>
						);
					}
					return null;
				})}
			</StatsRow>
		</>
	);
};

const SynthsCharts = styled.div`
	max-width: ${MAX_PAGE_WIDTH}px;
	display: flex;
	margin: 20px auto;
	justify-content: space-between;
	@media only screen and (max-width: 854px) {
		display: block;
	}
`;

const SubsectionHeader = styled.div`
	max-width: ${MAX_PAGE_WIDTH}px;
	font-family: ${(props) => `${props.theme.fonts.expanded}, ${props.theme.fonts.regular}`};
	font-style: normal;
	font-weight: 900;
	font-size: 20px;
	line-height: 120%;
	margin: 40px auto 20px auto;
	color: ${(props) => props.theme.colors.white};
`;

export default SynthsSection;
