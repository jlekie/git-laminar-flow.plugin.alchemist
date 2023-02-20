import * as _ from 'lodash';
import * as Path from 'path';
import * as FS from 'fs-extra';
import * as Zod from 'zod';

import { Command, Option } from 'clipanion';

import { PluginHandler, BaseCommand, Config } from '@jlekie/git-laminar-flow-cli';
import { createDataAdapter, transmute, Manifest } from '@jlekie/alchemist';

const OptionsSchema = Zod.object({
    manifest: Zod.union([
        Zod.string(),
        Zod.object({})
    ]),
    included: Zod.record(Zod.string(), Zod.union([
        Zod.string(),
        Zod.string().array()
    ]).transform(value => _.isString(value) ? [ value ] : value)).default({})
});

const createPlugin: PluginHandler = (options) => {
    const parsedOptions = OptionsSchema.parse(options);

    return {
        init: async ({ config, stdout, dryRun }) => {
            await alchemyTransmute(config, parsedOptions);
        },
        updateVersion: async (oldVersion, newVersion, { config, stdout, dryRun }) => {
        },
        registerCommands: () => [
            class AlchemistCommand extends BaseCommand {
                static paths = [['alchemist']]
                static usage = Command.Usage({
                    description: 'Invoke Alchemist build command',
                    category: 'Alchemist'
                });

                args = Option.Rest();

                public async executeCommand() {
                    const config = await this.loadConfig();

                    await alchemyTransmute(config, parsedOptions);
                }
            }
        ]
    }
}

export async function alchemyTransmute(config: Config, options: Zod.infer<typeof OptionsSchema>) {
    const recursiveConfig = config.toContextHash();

    const dataAdapter = createDataAdapter();

    if (_.isString(options.manifest)) {
        const [ loadedManifest, manifestBasePath ] = await dataAdapter.loadManifest(options.manifest, recursiveConfig);

        await transmute({
            manifestBasePath,
            dataAdapter,
            loadedManifest,
            contextValues: {}
        });
    }
    else {
        const loadedManifest = Manifest.parse({
            ...options.manifest,
            context: recursiveConfig
        });

        await transmute({
            dataAdapter,
            loadedManifest,
            contextValues: {}
        });
    }
}

export default createPlugin;
