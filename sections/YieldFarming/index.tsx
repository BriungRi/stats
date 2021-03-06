import { ethers } from 'ethers';
import { FC, useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useTranslation, Trans } from 'react-i18next';

import SectionHeader from 'components/SectionHeader';
import SingleStatRow from 'components/SingleStatRow';
import StatsRow from 'components/StatsRow';
import DoubleStatsBox from 'components/DoubleStatsBox';
import {
	curvepoolRewards,
	curveSusdPool,
	curveSusdPoolToken,
	curveSusdGauge,
	curveGaugeController,
} from 'contracts/index.js';

import { COLORS } from 'constants/styles';
import { SNXJSContext, SNXContext, ProviderContext } from 'pages/_app';
import { getAaveDepositRate, getCurveTokenPrice } from 'utils/customGraphQueries';
import { formatPercentage } from 'utils/formatter';
import { FullLineText } from '../../components/common';

const SubtitleText = ({ name }: { name: string }) =>
	name === 'sUSD' ? (
		<Trans
			i18nKey={'yield-farming-subtitle-text.sUSD'}
			values={{
				name,
			}}
		/>
	) : (
		<Trans
			i18nKey={'yield-farming-subtitle-text.default'}
			values={{
				name,
			}}
		/>
	);

type APYFields = {
	price: number;
	balanceOf: number;
};

const YieldFarming: FC = () => {
	const { t } = useTranslation();
	const [distributions, setDistributions] = useState<{ [address: string]: number } | null>(null);
	const [aaveDepositRate, setAaveDepositRate] = useState<number | null>(null);
	const [iEthAPYFields, setiEthAPYFields] = useState<APYFields | null>(null);
	const [iBtcAPYFields, setiBtcAPYFields] = useState<APYFields | null>(null);
	const [curveAPYFields, setCurveAPYFields] = useState<APYFields | null>(null);
	const [curveSwapAPY, setCurveSwapAPY] = useState<number | null>(null);
	const [curveTokenAPY, setCurveTokenAPY] = useState<number | null>(null);
	const snxjs = useContext(SNXJSContext);
	const { SNXPrice } = useContext(SNXContext);
	const provider = useContext(ProviderContext);

	useEffect(() => {
		const curvepoolContract = new ethers.Contract(
			curvepoolRewards.address,
			curvepoolRewards.abi,
			provider
		);
		const curveSusdPoolContract = new ethers.Contract(
			curveSusdPool.address,
			// @ts-ignore
			curveSusdPool.abi,
			provider
		);
		const curveSusdPoolTokenContract = new ethers.Contract(
			curveSusdPoolToken.address,
			curveSusdPoolToken.abi,
			provider
		);
		const curveSusdGaugeContract = new ethers.Contract(
			curveSusdGauge.address,
			// @ts-ignore
			curveSusdGauge.abi,
			provider
		);
		const curveGaugeControllerContract = new ethers.Contract(
			curveGaugeController.address,
			// @ts-ignore
			curveGaugeController.abi,
			provider
		);

		const fetchData = async () => {
			try {
				const contracts = [
					curvepoolContract,
					snxjs.contracts.StakingRewardsiETH,
					snxjs.contracts.StakingRewardsiBTC,
				];
				const rewardsData = await Promise.all(
					contracts.map((contract) => {
						const getDuration = contract.DURATION || contract.rewardsDuration;
						return Promise.all([getDuration(), contract.rewardRate(), contract.periodFinish()]);
					})
				);
				let contractRewards = {};
				rewardsData.forEach(([duration, rate, periodFinish], i) => {
					const durationInWeeks = Number(duration) / 3600 / 24 / 7;
					const isPeriodFinished = new Date().getTime() > Number(periodFinish) * 1000;
					// @ts-ignore
					contractRewards[contracts[i].address] = isPeriodFinished
						? 0
						: Math.trunc(Number(duration) * (rate / 1e18)) / durationInWeeks;
				});
				setDistributions(contractRewards);

				const fetchedData = await Promise.all([
					snxjs.contracts.ProxyiETH.balanceOf(snxjs.contracts.StakingRewardsiETH.address),
					snxjs.contracts.ProxyiBTC.balanceOf(snxjs.contracts.StakingRewardsiBTC.address),
					snxjs.contracts.ExchangeRates.rateForCurrency(snxjs.toBytes32('iETH')),
					snxjs.contracts.ExchangeRates.rateForCurrency(snxjs.toBytes32('iBTC')),
					curveSusdPoolTokenContract.balanceOf(curvepoolRewards.address),
					curveSusdPoolContract.get_virtual_price(),
					curveSusdGaugeContract.inflation_rate(),
					curveSusdGaugeContract.working_supply(),
					curveGaugeControllerContract.gauge_relative_weight(curveSusdGauge.address),
					getAaveDepositRate(),
					getCurveTokenPrice(),
					axios.get('https://www.curve.fi/raw-stats/apys.json'),
				]);

				const [
					iEthBalance,
					iBtcBalance,
					iEthPrice,
					iBtcPrice,
					curveSusdBalance,
					curveSusdTokenPrice,
					curveInflationRate,
					curveWorkingSupply,
					gaugeRelativeWeight,
				] = fetchedData.slice(0, 9).map((data) => Number(snxjs.utils.formatEther(data)));

				const rate =
					(((curveInflationRate * gaugeRelativeWeight * 31536000) / curveWorkingSupply) * 0.4) /
					curveSusdTokenPrice;
				const curvePrice = fetchedData[10];
				setCurveTokenAPY(rate * curvePrice);

				setiEthAPYFields({ balanceOf: iEthBalance, price: iEthPrice });
				setiBtcAPYFields({ balanceOf: iBtcBalance, price: iBtcPrice });
				setCurveAPYFields({ balanceOf: curveSusdBalance, price: curveSusdTokenPrice });
				setAaveDepositRate(fetchedData[9]);

				const swapAPY = fetchedData[11]?.data?.apy?.day?.susd ?? 0;
				setCurveSwapAPY(swapAPY);
			} catch (e) {
				setDistributions(null);
			}
		};
		fetchData();
	}, []);

	return (
		<>
			<SectionHeader title={t('section-header.yieldFarming')} />
			<SingleStatRow
				text={t('lending-apy.title')}
				subtext={t('lending-apy.subtext')}
				num={aaveDepositRate}
				color={COLORS.green}
				numberStyle="percent2"
			/>
			<StatsRow>
				<DoubleStatsBox
					key="CRVSUSDRWRDS"
					title={t('curve-susd.title')}
					subtitle={<SubtitleText name="sUSD" />}
					firstMetricTitle={t('curve-susd.firstMetricTitle')}
					firstMetricStyle="number"
					firstMetric={
						distributions != null ? distributions[curvepoolRewards.address] : distributions
					}
					firstColor={COLORS.pink}
					secondMetricTitle={t('curve-susd.secondMetricTitle')}
					secondMetric={
						SNXPrice != null &&
						distributions != null &&
						curveAPYFields != null &&
						curveSwapAPY != null &&
						curveTokenAPY != null
							? ((distributions[curvepoolRewards.address] * (SNXPrice ?? 0)) /
									(curveAPYFields.balanceOf * curveAPYFields.price)) *
									52 +
							  curveSwapAPY +
							  curveTokenAPY
							: null
					}
					secondColor={COLORS.green}
					secondMetricStyle="percent2"
					infoData={
						<Trans
							i18nKey={'curve-susd.infoData'}
							values={{
								rewards: curveTokenAPY != null ? formatPercentage(curveTokenAPY) : '...',
								snxRewards:
									distributions != null && curveAPYFields != null && SNXPrice != null
										? formatPercentage(
												((distributions[curvepoolRewards.address] * (SNXPrice ?? 0)) /
													(curveAPYFields.balanceOf * curveAPYFields.price)) *
													52
										  )
										: '...',
								swapFees: curveSwapAPY != null ? formatPercentage(curveSwapAPY) : '...',
							}}
							components={{
								fullLineText: <FullLineText />,
							}}
						/>
					}
				/>
				<DoubleStatsBox
					key="iETHRWRDS"
					title={t('iETH.title')}
					subtitle={<SubtitleText name="iETH" />}
					firstMetricTitle={t('iETH.firstMetricTitle')}
					firstMetricStyle="number"
					firstMetric={
						distributions != null
							? distributions[snxjs.contracts.StakingRewardsiETH.address]
							: distributions
					}
					firstColor={COLORS.green}
					secondMetricTitle={t('iETH.secondMetricTitle')}
					secondMetric={
						distributions != null && iEthAPYFields != null && SNXPrice != null
							? ((distributions[snxjs.contracts.StakingRewardsiETH.address] * (SNXPrice ?? 0)) /
									(iEthAPYFields.balanceOf * iEthAPYFields.price)) *
							  52
							: null
					}
					secondColor={COLORS.green}
					secondMetricStyle="percent2"
				/>
				<DoubleStatsBox
					key="iBTCRWRDS"
					title={t('iBTC.title')}
					subtitle={<SubtitleText name="iBTC" />}
					firstMetricTitle={t('iBTC.firstMetricTitle')}
					firstMetricStyle="number"
					firstMetric={
						distributions != null
							? distributions[snxjs.contracts.StakingRewardsiBTC.address]
							: distributions
					}
					firstColor={COLORS.green}
					secondMetricTitle={t('iBTC.secondMetricTitle')}
					secondMetric={
						distributions != null && iBtcAPYFields != null && SNXPrice != null
							? ((distributions[snxjs.contracts.StakingRewardsiBTC.address] * (SNXPrice ?? 0)) /
									(iBtcAPYFields.balanceOf * iBtcAPYFields.price)) *
							  52
							: null
					}
					secondColor={COLORS.green}
					secondMetricStyle="percent2"
				/>
			</StatsRow>
		</>
	);
};

export default YieldFarming;
