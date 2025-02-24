/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                          ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import type { AxiosInstance, AxiosRequestConfig, HeadersDefaults, ResponseType } from "axios";
import axios from "axios";
import {
  ContentType,
  IseuserappLoginPost,
  IseuserappLoginResponse,
  ObjsapiDownloadRequest,
  ObjsapiDownloadResponse,
  ObjsapiGetTypeResponse,
  ObjsapiObjectLogRetrieveRequest,
  ObjsapiObjectLogRetrieveResponse,
  ObjsapiSearchByNameObjectRequest,
  ObjsapiSearchRequest,
  ObjsapiSearchResponse,
  ObjsapiUploadRequest,
  ObjsapiUploadResponse,
} from './constellationTypes';

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseType;
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private secure?: boolean;
  private format?: ResponseType;

  constructor({ securityWorker, secure, format, ...axiosConfig }: ApiConfig<SecurityDataType> = {}) {
    this.instance = axios.create({
      ...axiosConfig,
      baseURL: axiosConfig.baseURL || "https://constellation.emeraldcloudlab.com",
    });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected mergeRequestParams(params1: AxiosRequestConfig, params2?: AxiosRequestConfig): AxiosRequestConfig {
    const method = params1.method || (params2 && params2.method);

    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...((method && this.instance.defaults.headers[method.toLowerCase() as keyof HeadersDefaults]) || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected stringifyFormItem(formItem: unknown) {
    if (typeof formItem === "object" && formItem !== null) {
      return JSON.stringify(formItem);
    } else {
      return `${formItem}`;
    }
  }

  protected createFormData(input: Record<string, unknown>): FormData {
    if (input instanceof FormData) {
      return input;
    }
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      const propertyContent: any[] = property instanceof Array ? property : [property];

      for (const formItem of propertyContent) {
        const isFileType = formItem instanceof Blob || formItem instanceof File;
        formData.append(key, isFileType ? formItem : this.stringifyFormItem(formItem));
      }

      return formData;
    }, new FormData());
  }

  public request = async <T = any, _E = any>({
    secure,
    path,
    type,
    query,
    format,
    body,
    ...params
  }: FullRequestParams): Promise<T> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = format || this.format || undefined;

    if (type === ContentType.FormData && body && body !== null && typeof body === "object") {
      body = this.createFormData(body as Record<string, unknown>);
    }

    if (type === ContentType.Text && body && body !== null && typeof body !== "string") {
      body = JSON.stringify(body);
    }

    return this.instance
      .request({
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type ? { "Content-Type": type } : {}),
        },
        params: query,
        responseType: responseFormat,
        data: body,
        url: path,
      })
      .then((response) => response.data);
  };
}

/**
 * @title Constellation API Documentation
 * @version 1.1.3
 * @baseUrl https://constellation.emeraldcloudlab.com
 * @contact Emerald Cloud Lab <developer-support@emeraldcloudlab.com> (/)
 *
 * Emerald Cloud Lab® (ECL®) is the only remotely operated research facility that handles all aspects of daily lab work —
 * method design, materials logistics, sample preparation, instrument operation, data acquisition and analysis,
 * troubleshooting, waste disposal, and everything in between — without the user ever setting foot in the lab.
 *
 * While everything in ECL is available via Symbol Lab Language (SLL) APIs in Command Center, it is sometimes desirable
 * to programmatically manipulate the data within ECL outside of Command Center.  This is best done via the Constellation
 * API described below.
 *
 * The first step to manipulating data via the Constellation API is generating an AuthToken via the Login API described
 * below.  This token must be supplied in every subsequent request to constellation in the Authorization header with the
 * form Authorization: Bearer "authToken"
 *
 * Every piece of data in constellation is identified by a type and an id, both of which are strings.  A type consists of
 * of a name and one or more parent types.  For example, Object.Data.Chromatography (which represents Chromatography data)
 * has name Chromatography with parent types Data and Object.  Each type defines a set of fields which hold values of
 * of data for that object.  The fields are both set on the base type and are inherited from parent types.  To retrieve a list
 * of types and their fields, consult the GetTypes API described below.  The id of an object is a simple string, which is typically
 * of the form "id:abcdef"
 *
 * There are three basic operations on constellation: upload - for creating or modifying data, download - for retrieving download,
 * and search - for finding data.  These APIs are described in detail below.  There are additional operations like finding all changes
 * to an object, also described below.
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  ise = {
    /**
     * @description Signin to the application.  This will return an auth token that should be included in the Authorization header
     *
     * @tags Login
     * @name SignintokenCreate
     * @summary Signin to the application
     * @request POST:/ise/signintoken
     */
    signintokenCreate: (data: IseuserappLoginPost, params: RequestParams = {}) =>
      this.request<IseuserappLoginResponse, any>({
        path: `/ise/signintoken`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  obj = {
    /**
     * @description Download information about one or more objects.
     *
     * @tags Download
     * @name DownloadCreate
     * @summary Download information about one or more objects
     * @request POST:/obj/download
     * @secure
     */
    downloadCreate: (data: ObjsapiDownloadRequest, params: RequestParams = {}) =>
      this.request<ObjsapiDownloadResponse, any>({
        path: `/obj/download`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Returns the list of all changes that have been made over time to the supplied object or type
     *
     * @tags Object Logs
     * @name ObjectlogCreate
     * @summary Show the list of changes to the supplied objects or types
     * @request POST:/obj/objectlog
     * @secure
     */
    objectlogCreate: (data: ObjsapiObjectLogRetrieveRequest, params: RequestParams = {}) =>
      this.request<ObjsapiObjectLogRetrieveResponse, any>({
        path: `/obj/objectlog`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Search on objects within constellation.
     *
     * @tags Search
     * @name SearchCreate
     * @summary Search on objects in constellation
     * @request POST:/obj/search
     * @secure
     */
    searchCreate: (data: ObjsapiSearchRequest, params: RequestParams = {}) =>
      this.request<ObjsapiSearchResponse, any>({
        path: `/obj/search`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Search by object name on objects within constellation.  Note that is possible to simply pass the query on name to the normal search endpoint, but generally this will be faster and less resource intensive.
     *
     * @tags Search
     * @name SearchByNameCreate
     * @summary Search by object name on objects in constellation
     * @request POST:/obj/search-by-name
     * @secure
     */
    searchByNameCreate: (data: ObjsapiSearchByNameObjectRequest, params: RequestParams = {}) =>
      this.request<ObjsapiSearchResponse, any>({
        path: `/obj/search-by-name`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a list of all supported types in constellation
     *
     * @tags Types
     * @name TypeList
     * @summary Get a list of all supported types in constellation
     * @request GET:/obj/type/
     * @secure
     */
    typeList: (params: RequestParams = {}) =>
      this.request<ObjsapiGetTypeResponse[], any>({
        path: `/obj/type/`,
        method: "GET",
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get information about a supplied type
     *
     * @tags Types
     * @name TypeDetail
     * @summary Get information about a type
     * @request GET:/obj/type/{name}
     * @secure
     */
    typeDetail: (name: string, params: RequestParams = {}) =>
      this.request<ObjsapiGetTypeResponse, any>({
        path: `/obj/type/${name}`,
        method: "GET",
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update or create one or more objects in constellation
     *
     * @tags Upload
     * @name UploadCreate
     * @summary Update or create one or more objects in constellation
     * @request POST:/obj/upload
     * @secure
     */
    uploadCreate: (data: ObjsapiUploadRequest, params: RequestParams = {}) =>
      this.request<ObjsapiUploadResponse, any>({
        path: `/obj/upload`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
