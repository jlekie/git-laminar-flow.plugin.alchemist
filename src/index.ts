import * as _ from 'lodash';
import * as Path from 'path';
import * as FS from 'fs-extra';
import * as Zod from 'zod';

import { Command, Option } from 'clipanion';

import { PluginHandler } from '@jlekie/git-laminar-flow-cli';
import { BaseCommand } from '@jlekie/git-laminar-flow-cli';
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
                    const configs = config.flattenConfigs();

                    const filteredConfigs = configs.filter(c => {
                        const labels = c.normalizeLabels();

                        return _.every(parsedOptions.included, (v, k) => labels[k]?.some(l => v.indexOf(l) >= 0))
                    });

                    const dataAdapter = createDataAdapter();

                    if (_.isString(parsedOptions.manifest)) {
                        const [ loadedManifest, manifestBasePath ] = await dataAdapter.loadManifest(parsedOptions.manifest, {
                            configs: filteredConfigs.map(c => c.toHash())
                        });

                        await transmute({
                            manifestBasePath,
                            dataAdapter,
                            loadedManifest,
                            contextValues: {}
                        });
                    }
                    else {
                        const loadedManifest = Manifest.parse({
                            ...parsedOptions.manifest,
                            context: {
                                configs: filteredConfigs.map(c => c.toHash())
                            }
                        });

                        await transmute({
                            dataAdapter,
                            loadedManifest,
                            contextValues: {}
                        });
                    }
                }
            }
        ]
    }
}

export default createPlugin;
